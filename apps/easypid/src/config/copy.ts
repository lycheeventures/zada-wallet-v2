import { defineMessage } from '@lingui/core/macro'
import { useAssets } from 'expo-asset'
import { type AppType, CURRENT_APP_TYPE } from './appType'

export const copy = {
  FUNKE_WALLET: {
    about: {
      description: defineMessage({
        id: 'funkeWallet.about.description',
        message:
          'This app was created by Animo Solutions in the context of the SPRIN-D Funke ‘EUDI Wallet Prototypes’. It serves as a prototype for future wallet providers. All code is available under Apache 2.0.',
        comment: 'About screen description text for the Funke wallet',
      }),
      emailHeader: defineMessage({
        id: 'funkeWallet.about.emailHeader',
        message: 'Reach out from Funke EUDI Wallet',
        comment: 'Email subject when contacting support from Funke wallet',
      }),
    },
  },
  PARADYM_WALLET: {
    about: {
      description: defineMessage({
        id: 'paradymWallet.about.description',
        message:
          'ZADA is a digital identity technology company focused on enabling secure and privacy-preserving access to digital services. Our goal is to help individuals and organizations interact digitally with greater trust, while minimizing fraud and unnecessary data exposure.\n\nWith ZADA, users remain in control of their personal data and can choose what information to share, with whom, and for what purpose.\n\nThis application is based on open-source software and includes components developed by Animo Solutions and other contributors, licensed under the Apache License, Version 2.0. ZADA Network has modified and extended this software as part of its implementation.\n\nUnless otherwise stated, the software is provided “as is,” without warranties or conditions of any kind.\n\nZADA supports an ecosystem approach to digital identity, enabling trusted and reusable interactions across services.\n',
        comment: 'About screen description text for the Paradym wallet',
      }),
      emailHeader: defineMessage({
        id: 'paradymWallet.about.emailHeader',
        message: 'Reach out from Paradym Wallet',
        comment: 'Email subject when contacting support from Paradym wallet',
      }),
    },
  },
} satisfies Record<AppType, Record<string, unknown>>

export function useAppCopy() {
  return copy[CURRENT_APP_TYPE]
}

export function useAppIcon() {
  const [assets] = useAssets([require('../../assets/funke/icon.png'), require('../../assets/paradym/icon.png')])
  if (CURRENT_APP_TYPE === 'FUNKE_WALLET') {
    return assets?.[0]
  }
  return assets?.[1]
}
