import { PassportScanScreen } from '@easypid/features/passport/PassportScanScreen'
import { useRouter } from 'expo-router'
import { Alert } from 'react-native'

export default function Screen() {
  const { back } = useRouter()

  return (
    <PassportScanScreen
      onMrzScanned={(mrz) => {
        // P2 ends here. P3 will continue to the NFC chip read using the BAC/PACE key inputs
        // (mrz.documentNumber / mrz.dateOfBirth / mrz.dateOfExpiry), then issue via hovi-issue-passport.
        Alert.alert(
          'MRZ captured',
          `Passport ${mrz.documentNumber}\nDOB ${mrz.dateOfBirth} · Expiry ${mrz.dateOfExpiry}\n\nChip read (NFC) comes next.`,
          [{ text: 'OK', onPress: () => back() }]
        )
      }}
    />
  )
}
