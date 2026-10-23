export type LegalDocumentSection = {
  heading: string
  paragraphs: string[]
}

export type LegalDocumentContent = {
  title: string
  sections: LegalDocumentSection[]
}

export const LEGAL_PLACEHOLDER_MARKER = '[À COMPLÉTER'

export const LEGAL_NOTICE_DOCUMENT: LegalDocumentContent = {
  title: 'Mentions légales',
  sections: [
    {
      heading: 'Éditeur du site',
      paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : nom de l'éditeur]`, `${LEGAL_PLACEHOLDER_MARKER} : statut et adresse]`],
    },
    {
      heading: 'Directeur de la publication',
      paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : nom du directeur de la publication]`],
    },
    {
      heading: 'Contact',
      paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : adresse e-mail de contact]`],
    },
    {
      heading: 'Hébergeur',
      paragraphs: ['Vercel Inc., 440 N Barranca Ave, Suite 4133, Covina, CA 91723, États-Unis — vercel.com'],
    },
  ],
}

export const PRIVACY_POLICY_DOCUMENT: LegalDocumentContent = {
  title: 'Confidentialité',
  sections: [
    {
      heading: 'Ce que la page Aled collecte',
      paragraphs: [
        "Cette page de présentation ne crée aucun compte, ne demande aucune information et ne dépose aucun cookie.",
      ],
    },
    {
      heading: "Mesure d'audience",
      paragraphs: [
        "Nous comptons les visites avec Vercel Web Analytics. Cet outil fonctionne sans cookie et ne conserve aucune donnée permettant de t'identifier : il nous dit seulement combien de personnes passent et par quelles pages.",
      ],
    },
    {
      heading: 'Une question ?',
      paragraphs: ["Écris-nous à l'adresse indiquée dans les mentions légales."],
    },
  ],
}

export const TERMS_OF_USE_DOCUMENT: LegalDocumentContent = {
  title: "Conditions d'utilisation",
  sections: [
    { heading: 'Objet', paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : objet du service]`] },
    { heading: 'Compte', paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : création et usage du compte]`] },
    { heading: "Usage de l'IA et clé Claude", paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : usage de l'IA et clé Claude fournie par l'utilisateur]`] },
    { heading: 'Données', paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : données personnelles et export]`] },
    { heading: 'Responsabilité', paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : limites de responsabilité]`] },
    { heading: 'Résiliation', paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : suppression du compte et fin du service]`] },
    { heading: 'Droit applicable', paragraphs: [`${LEGAL_PLACEHOLDER_MARKER} : droit applicable et juridiction compétente]`] },
  ],
}
