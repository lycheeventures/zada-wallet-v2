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
// NOTE: property/enum names below were validated against the resolved NFCPassportReader 2.3.1 public
// API (2026-07-05) — see the fixes applied then: `getMRZKey` is inlined (the library ships it only in
// its example app, not the importable module), `documentExpiryDate` replaces the non-existent
// `dateOfExpiry`, and passive-auth reads `passportDataNotTampered`. Still compile once on a real build.
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
      // getMRZKey is inlined below — NFCPassportReader ships it only in its example app, not the module.
      let mrzKey = getMRZKey(
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
    //
    // The portrait MUST be downscaled first. Re-encoding the chip's JPEG2000 as a full-resolution JPEG
    // inflates a ~15-20 KB DG2 image to ~60-150 KB, and base64 adds a further third on top. Android
    // passes the raw JP2 through untouched and stays small, so this bloat is iOS-only — which is why
    // passport verification 500'd on iOS while succeeding on Android: the portrait is a required claim
    // for face matching, so it rides along in every presentation, and the oversized one exceeds what
    // Hovi accepts on the verification endpoint (it 500s rather than reporting a size error). The
    // driver-license issuer hit the same Hovi limit and fixed it the same way — see
    // verifiable-link-issuer's image.server.ts, whose 60 KB threshold is the best evidence we have of
    // where that limit sits. Bound the longest side and drop the quality: enough detail to face-match
    // (Android matches on ~240x320-480x640 DG2 images), comfortably under the limit.
    var faceBase64: String? = nil
    if let image = p.passportImage,
      let jpeg = downscaledJpeg(image, maxDimension: 480, quality: 0.7)
    {
      faceBase64 = jpeg.base64EncodedString()
    }

    // MVP passive auth parity with Android (DG-hash integrity): `passportDataNotTampered` = the DG
    // hashes match the signed EF.SOD. Production must also AND `passportCorrectlySigned` and chain the
    // DSC to a trusted CSCA masterlist (NFCPassportReader supports loading PEM masterlists).
    let passed = p.passportDataNotTampered
    return [
      "documentCode": p.documentType,
      "documentNumber": p.documentNumber,
      "issuingState": p.issuingAuthority,
      "nationality": p.nationality,
      "primaryIdentifier": p.lastName,
      "secondaryIdentifier": p.firstName,
      "dateOfBirth": p.dateOfBirth,
      "dateOfExpiry": p.documentExpiryDate,
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

  /// JPEG-encode `image`, first scaling it down so its longest side is at most `maxDimension`.
  /// Images already within the bound are encoded at their own size — never upscaled, since that would
  /// add bytes without adding detail. Returns nil only if encoding fails, matching the previous
  /// `jpegData` behaviour (the caller then reports no portrait rather than a broken one).
  private func downscaledJpeg(_ image: UIImage, maxDimension: CGFloat, quality: CGFloat) -> Data? {
    let longest = max(image.size.width, image.size.height)
    guard longest > maxDimension, longest > 0 else {
      return image.jpegData(compressionQuality: quality)
    }

    let scale = maxDimension / longest
    let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)

    // Draw at scale 1 so `target` is in pixels, not points — otherwise the output is silently
    // multiplied by the device's screen scale (2x/3x) and we ship the bloat we are trying to avoid.
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: target))
    }
    return resized.jpegData(compressionQuality: quality)
  }
}

// ICAO 9303 MRZ-key derivation. NFCPassportReader provides this only in its example app
// (`Examples/*/Model/PassportUtils.swift`), NOT in the importable `NFCPassportReader` module, so it is
// inlined here verbatim. Builds the BAC/PACE key: padded docNo+checkdigit / DOB+checkdigit / expiry+checkdigit.
private func getMRZKey(passportNumber: String, dateOfBirth: String, dateOfExpiry: String) -> String {
  let pptNr = pad(passportNumber, fieldLength: 9)
  let dob = pad(dateOfBirth, fieldLength: 6)
  let exp = pad(dateOfExpiry, fieldLength: 6)
  return "\(pptNr)\(calcCheckSum(pptNr))\(dob)\(calcCheckSum(dob))\(exp)\(calcCheckSum(exp))"
}

private func pad(_ value: String, fieldLength: Int) -> String {
  return String((value + String(repeating: "<", count: fieldLength)).prefix(fieldLength))
}

private func calcCheckSum(_ checkString: String) -> Int {
  let characterDict = [
    "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9",
    "<": "0", " ": "0", "A": "10", "B": "11", "C": "12", "D": "13", "E": "14", "F": "15", "G": "16",
    "H": "17", "I": "18", "J": "19", "K": "20", "L": "21", "M": "22", "N": "23", "O": "24", "P": "25",
    "Q": "26", "R": "27", "S": "28", "T": "29", "U": "30", "V": "31", "W": "32", "X": "33", "Y": "34",
    "Z": "35",
  ]
  var sum = 0
  var m = 0
  let multipliers = [7, 3, 1]
  for c in checkString {
    guard let lookup = characterDict["\(c)"], let number = Int(lookup) else { return 0 }
    sum += number * multipliers[m]
    m = (m + 1) % 3
  }
  return sum % 10
}
