import * as Print from 'expo-print'
import * as FileSystem from 'expo-file-system/legacy'
import { CredentialForDisplay } from '@package/agent/display'

export async function useShareCredential(
  credential: CredentialForDisplay
): Promise<string | null> {
  try {
    if (!credential) return null
    
    // convert credential attributes to HTML format for PDF generation
    const html = `
      <html>
        <body style="font-family: Arial; padding: 24px;">
          <h2>${credential.display?.name ?? 'Credential'}</h2>
          <hr />
          ${credential.attributes
            ?.map((attr: any) => {
              const key = attr?.label || attr?.name || 'Unknown'
              const value = attr?.value ?? ''
              return `<p><strong>${key}:</strong> ${value}</p>`
            })
            .join('')}
        </body>
      </html>
    `
    const { uri } = await Print.printToFileAsync({ html })

    // Generate a safe file name based on the credential name
    const fileName = (credential.display?.name ?? 'Credential')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]/g, '')

    const newPath = `${FileSystem.documentDirectory}${fileName}.pdf`

    await FileSystem.moveAsync({
      from: uri,
      to: newPath,
    })

    return newPath

  } catch (error) {
    console.log('PDF generate error:', error)
    return null
  }
}