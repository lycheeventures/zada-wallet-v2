package io.zada.passportnfc

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import net.sf.scuba.smartcards.CardService
import org.jmrtd.BACKey
import org.jmrtd.PACEKeySpec
import org.jmrtd.PassportService
import org.jmrtd.lds.CardAccessFile
import org.jmrtd.lds.PACEInfo
import org.jmrtd.lds.SODFile
import org.jmrtd.lds.icao.DG1File
import org.jmrtd.lds.icao.DG2File
import org.jmrtd.lds.iso19794.FaceImageInfo
import java.io.DataInputStream
import java.security.MessageDigest
import java.security.Security

// Reads an ICAO 9303 eMRTD (passport) chip over NFC using jMRTD: PACE (fallback BAC) with the MRZ
// key, then DG1 (MRZ) + DG2 (portrait), then MVP passive authentication.
//
// MVP passive auth = DG-hash integrity: recompute the DG1/DG2 hashes and compare to the hashes in
// the signed EF.SOD. This proves the data matches the SOD. TODO(prod): also verify the SOD's CMS
// signature against the Document Signer Cert AND chain the DSC to a trusted CSCA (masterlist) — only
// then is `chipAuthenticated` true "State-signed". Today we trust the chip we just read (matches the
// MVP server trust model in hovi-issue-passport).
class PassportNfcModule : Module() {
  private var pendingPromise: Promise? = null
  private var request: Triple<String, String, String>? = null

  init {
    // jMRTD relies on the SpongyCastle (BouncyCastle-for-Android) provider for several algorithms.
    try {
      Security.insertProviderAt(org.spongycastle.jce.provider.BouncyCastleProvider(), 1)
    } catch (_: Throwable) {}
  }

  override fun definition() = ModuleDefinition {
    Name("PassportNfc")
    Events("onStatus")

    AsyncFunction("isNfcAvailable") {
      val adapter = NfcAdapter.getDefaultAdapter(appContext.reactContext)
      adapter != null && adapter.isEnabled
    }

    AsyncFunction("readPassport") { documentNumber: String, dateOfBirth: String, dateOfExpiry: String, promise: Promise ->
      val activity = appContext.currentActivity ?: return@AsyncFunction promise.reject(CodedException("NO_ACTIVITY", "No current activity", null))
      val adapter = NfcAdapter.getDefaultAdapter(activity)
      if (adapter == null || !adapter.isEnabled) {
        return@AsyncFunction promise.reject(CodedException("NFC_UNAVAILABLE", "NFC is off or unsupported", null))
      }
      pendingPromise = promise
      request = Triple(documentNumber, dateOfBirth, dateOfExpiry)
      emit("waiting_for_tag")
      // Reader mode delivers tags on a background thread — safe to do blocking APDU I/O in onTag.
      adapter.enableReaderMode(
        activity,
        { tag -> onTag(tag, activity) },
        NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
        null
      )
    }

    AsyncFunction("cancel") {
      disableReader()
      pendingPromise = null
      request = null
    }

    OnDestroy { disableReader() }
  }

  private fun emit(status: String) = sendEvent("onStatus", mapOf("status" to status))

  private fun disableReader() {
    val activity = appContext.currentActivity ?: return
    try {
      NfcAdapter.getDefaultAdapter(activity)?.disableReaderMode(activity)
    } catch (_: Throwable) {}
  }

  private fun onTag(tag: Tag, activity: Activity) {
    val promise = pendingPromise ?: return
    val (documentNumber, dateOfBirth, dateOfExpiry) = request ?: return
    val isoDep = IsoDep.get(tag)
    if (isoDep == null) {
      promise.reject(CodedException("TAG_LOST", "Tag is not an ISO-DEP (passport) tag", null))
      finish()
      return
    }
    try {
      emit("tag_detected")
      isoDep.timeout = 15000
      val service = PassportService(
        CardService.getInstance(isoDep),
        PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
        PassportService.DEFAULT_MAX_BLOCKSIZE,
        false,
        false
      )
      service.open()

      emit("authenticating")
      val paceSucceeded = tryPace(service, documentNumber, dateOfBirth, dateOfExpiry)
      service.sendSelectApplet(paceSucceeded)
      if (!paceSucceeded) {
        service.doBAC(BACKey(documentNumber, dateOfBirth, dateOfExpiry))
      }

      emit("reading_dg1")
      val dg1 = DG1File(service.getInputStream(PassportService.EF_DG1))
      val mrz = dg1.mrzInfo

      emit("reading_dg2")
      val dg2 = DG2File(service.getInputStream(PassportService.EF_DG2))
      val (faceBase64, faceMime) = extractFace(dg2)

      emit("verifying")
      val (chipAuthenticated, detail) = verifyIntegrity(service, dg1.encoded, dg2.encoded)

      emit("done")
      promise.resolve(
        mapOf(
          "documentCode" to mrz.documentCode,
          "documentNumber" to mrz.documentNumber,
          "issuingState" to mrz.issuingState,
          "nationality" to mrz.nationality,
          "primaryIdentifier" to mrz.primaryIdentifier?.replace("<", " ")?.trim(),
          "secondaryIdentifier" to mrz.secondaryIdentifier?.replace("<", " ")?.trim(),
          "dateOfBirth" to mrz.dateOfBirth,
          "dateOfExpiry" to mrz.dateOfExpiry,
          "gender" to mrz.gender.toString(),
          "personalNumber" to mrz.personalNumber,
          "mrz" to mrz.toString(),
          "faceImageBase64" to faceBase64,
          "faceImageMimeType" to faceMime,
          "chipAuthenticated" to chipAuthenticated,
          "passiveAuthDetail" to detail
        )
      )
    } catch (e: Exception) {
      val code = if ((e.message ?: "").contains("SW=6300") || e is org.jmrtd.AccessDeniedException) "AUTH_FAILED" else "PASSPORT_READ_ERROR"
      promise.reject(CodedException(code, e.message ?: "Failed to read passport", e))
    } finally {
      try { isoDep.close() } catch (_: Throwable) {}
      finish()
    }
  }

  private fun finish() {
    disableReader()
    pendingPromise = null
    request = null
  }

  // Try PACE using the MRZ-derived key. Returns false (and leaves the channel unchanged) on any
  // failure so the caller can fall back to BAC.
  private fun tryPace(service: PassportService, doc: String, dob: String, doe: String): Boolean {
    return try {
      val cardAccess = CardAccessFile(service.getInputStream(PassportService.EF_CARD_ACCESS))
      val paceInfo = cardAccess.securityInfos.firstOrNull { it is PACEInfo } as? PACEInfo ?: return false
      val paceKey = PACEKeySpec.createMRZKey(BACKey(doc, dob, doe))
      service.doPACE(
        paceKey,
        paceInfo.objectIdentifier,
        PACEInfo.toParameterSpec(paceInfo.parameterId),
        paceInfo.parameterId
      )
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun extractFace(dg2: DG2File): Pair<String?, String?> {
    val infos = ArrayList<FaceImageInfo>()
    for (faceInfo in dg2.faceInfos) infos.addAll(faceInfo.faceImageInfos)
    val face = infos.firstOrNull() ?: return Pair(null, null)
    return try {
      val len = face.imageLength
      val bytes = ByteArray(len)
      DataInputStream(face.imageInputStream).use { it.readFully(bytes) }
      Pair(Base64.encodeToString(bytes, Base64.NO_WRAP), face.mimeType)
    } catch (_: Exception) {
      Pair(null, null)
    }
  }

  // MVP passive auth: DG1/DG2 hashes must match the hashes in the chip's signed EF.SOD.
  private fun verifyIntegrity(service: PassportService, dg1Bytes: ByteArray, dg2Bytes: ByteArray): Pair<Boolean, String> {
    return try {
      val sod = SODFile(service.getInputStream(PassportService.EF_SOD))
      val stored = sod.dataGroupHashes
      val md = MessageDigest.getInstance(sod.digestAlgorithm)
      val dg1Ok = stored[1]?.contentEquals(md.digest(dg1Bytes)) == true
      md.reset()
      val dg2Ok = stored[2]?.contentEquals(md.digest(dg2Bytes)) == true
      if (dg1Ok && dg2Ok) Pair(true, "DG1/DG2 hashes match EF.SOD (${sod.digestAlgorithm})")
      else Pair(false, "DG hash mismatch (dg1=$dg1Ok dg2=$dg2Ok)")
    } catch (e: Exception) {
      Pair(false, "passive auth error: ${e.message}")
    }
  }
}
