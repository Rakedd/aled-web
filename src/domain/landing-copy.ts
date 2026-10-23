export const LANDING_COPY = {
  header: {
    signIn: 'Se connecter',
  },
  hero: {
    titleStart: 'Trouver du boulot',
    struckText: 'en traversant la rue',
    titleEnd: 'depuis ton canapé.',
    subtitle:
      'Les missions arrivent toutes seules, Aled suit tes candidatures, te dit qui relancer et prépare tes entretiens. Toi, tu choisis.',
    callToAction: 'Je reste sur mon canapé',
  },
  pain: {
    titleStart: '300 sites. 1 boîte mail.',
    highlightedText: '0 idée',
    titleEnd: "de qui t'a répondu.",
    text: 'Tu postules partout, et après ? Les réponses se perdent entre deux newsletters, tu relances la mauvaise personne et tu découvres un entretien la veille.',
    emails: [
      { subject: 'Re: Re: Fwd:', detail: 'Mission React — 3 mois — Lyon ?' },
      { subject: 'Votre candidature a bien été reçue', detail: '(laquelle ?)' },
      { subject: 'Toujours dispo ?', detail: 'On en parle demain ?' },
      { subject: 'Rappel :', detail: 'entretien demain 9 h (avec qui déjà ?)' },
    ],
  },
  journey: {
    title: 'Du premier clic au premier jour.',
    text: "Aled t'accompagne à chaque étape. Tu n'as plus qu'à être bon en entretien.",
    steps: [
      {
        title: 'Trouver',
        text: 'Les missions qui te correspondent arrivent toutes seules. Fini le tour des 300 sites.',
      },
      { title: 'Postuler', text: "Un clic, c'est noté. Tu sais toujours où tu as envoyé quoi." },
      {
        title: 'Suivre',
        text: "Qui t'a répondu, qui t'a ghosté, quel intermédiaire pour quelle mission : tout est là.",
      },
      { title: 'Relancer', text: "Aled te dit qui relancer avant que tu oublies. Toi, tu as l'air organisé." },
      { title: "Préparer l'entretien", text: 'Le brief du client et ta préparation, prêts avant le café.' },
      { title: 'Relire le contrat', text: 'Les clauses qui piquent, repérées avant que tu signes.' },
      { title: 'Premier jour', text: 'Là, on te laisse. Il te reste juste à trouver la machine à café.' },
    ],
  },
  closing: {
    title: "« ALED, je sais plus à qui j'ai postulé. »",
    text: "Normal. Aled s'en souvient pour toi.",
    callToAction: 'Aled, sauve-moi',
  },
  footer: {
    copyright: '© Aled',
    legalNotice: 'Mentions légales',
    privacyPolicy: 'Confidentialité',
    termsOfUse: "Conditions d'utilisation",
  },
} as const
