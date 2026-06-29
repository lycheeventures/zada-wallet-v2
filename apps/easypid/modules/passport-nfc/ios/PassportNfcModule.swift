import CoreNFC
import ExpoModulesCore
import NFCPassportReader
import UIKit

// iOS counterpart of the Android jMRTD module. Reads an ICAO 9303 eMRTD (passport) chip via CoreNFC
// using AndyQ/NFCPassportReader (MIT): BAC/PACE with the MRZ-derived key → DG1 (MRZ) + DG2 (portrait)
// → passive authentication. It deliberately mirrors the Android module's JS contract exactly — same
// `PassportNfc` native name, `onStatus` events, and the same result dictionary keys — so index.ts and
// the feature UI work unchanged across platforms.
//
// NOTE: property/enum names below target NFCPassportReader's current API but could not be compiled in
// this workspace (no Apple toolchain). Verify against the resolved package version on the first iOS
// build; they are isolated to `map(_:)` and the display-message switch.
public class PassportNfcModule: Module {
  private let reader = PassportReader()

  public func definition() -> ModuleDefinition {
    Name("PassportNfc")
    Events("onStatus")

    AsyncFunction("isNfcAvailable") { () -> Bool in
      // CoreNFC tag reading requires iPhone 7+ on iOS 15+ with NFC enabled.
      return NFCTagReaderSession.readingAvailable
    }

    AsyncFunction("readPassport") {
      (documentNumber: String, dateOfBirth: String, dateOfExpiry: String, promise: Promise) in
      guard NFCTagReaderSession.readingAvailable else {
        promise.reject("NFC_UNAVAILABLE", "NFC is off or unsupported on this device")
        return
      }
      // Build the MRZ key (docNo+check / DOB+check / expiry+check) the same way the Android BACKey does.
      let mrzKey = PassportUtils.getMRZKey(
        passportNumber: documentNumber, dateOfBirth: dateOfBirth, dateOfExpiry: dateOfExpiry)

      self.sendEvent("onStatus", ["status": "waiting_for_tag"])
      Task {
        do {
          let passport = try await self.reader.readPassport(
            mrzKey: mrzKey,
            tags: [.COM, .DG1, .DG2, .SOD],
            customDisplayMessage: { (msg: NFCViewDisplayMessage) -> String? in
              // Map the reader's lifecycle to our shared status strings; return nil to keep the
              // library's default copy on Apple's system NFC sheet.
              switch msg {
              case .requestPresentPassport:
                self.sendEvent("onStatus", ["status": "waiting_for_tag"])
              case .authenticatingWithPassport:
                self.sendEvent("onStatus", ["status": "authenticating"])
              case .readingDataGroupProgress(let dg, _):
                self.sendEvent("onStatus", ["status": dg == .DG2 ? "reading_dg2" : "reading_dg1"])
              case .activeAuthentication:
                self.sendEvent("onStatus", ["status": "verifying"])
              case .successfulRead:
                self.sendEvent("onStatus", ["status": "done"])
              default:
                break
              }
              return nil
            }
          )
          self.sendEvent("onStatus", ["status": "verifying"])
          promise.resolve(self.map(passport))
        } catch let error as NFCPassportReaderError {
          // Wrong MRZ key surfaces as a tag/security error — surface AUTH_FAILED so the JS layer shows
          // the "re-check passport number / DOB / expiry" hint, matching Android.
          let code: String
          switch error {
          case .ResponseError: code = "AUTH_FAILED"
          default: code = "PASSPORT_READ_ERROR"
          }
          promise.reject(code, error.localizedDescription)
        } catch {
          promise.reject("PASSPORT_READ_ERROR", error.localizedDescription)
        }
      }
    }

    AsyncFunction("cancel") {
      // NFCPassportReader owns its NFCTagReaderSession and shows Apple's system sheet, which carries
      // its own Cancel button; there is no separate reader-mode to disable as on Android.
    }
  }

  private func map(_ p: NFCPassportModel) -> [String: Any?] {
    // iOS bonus: UIImage decodes JPEG2000 natively, so we always hand JS a renderable JPEG data URI —
    // sidestepping the Android JP2 problem. (passportImage is already decoded by the library.)
    var faceBase64: String? = nil
    if let image = p.passportImage, let jpeg = image.jpegData(compressionQuality: 0.9) {
      faceBase64 = jpeg.base64EncodedString()
    }

    // MVP passive auth parity with Android (DG-hash integrity / signed-SOD). Production must also
    // chain the DSC to a trusted CSCA masterlist (NFCPassportReader supports loading PEM masterlists).
    let passed = p.passiveAuthenticationPassed
    return [
      "documentCode": p.documentType,
      "documentNumber": p.documentNumber,
      "issuingState": p.issuingAuthority,
      "nationality": p.nationality,
      "primaryIdentifier": p.lastName,
      "secondaryIdentifier": p.firstName,
      "dateOfBirth": p.dateOfBirth,
      "dateOfExpiry": p.dateOfExpiry,
      "gender": normalizeGender(p.gender),
      "personalNumber": p.personalNumber,
      "mrz": p.passportMRZ,
      "faceImageBase64": faceBase64,
      "faceImageMimeType": faceBase64 != nil ? "image/jpeg" : nil,
      "chipAuthenticated": passed,
      "passiveAuthDetail": passed
        ? "Passive authentication passed" : "Passive authentication not verified",
    ]
  }

  // Normalize to the same tokens the Android jMRTD Gender enum yields, so issuePassport.ts'
  // genderToIso5218() maps identically on both platforms.
  private func normalizeGender(_ g: String) -> String {
    switch g.uppercased() {
    case "M", "MALE": return "MALE"
    case "F", "FEMALE": return "FEMALE"
    default: return "UNSPECIFIED"
    }
  }
}
