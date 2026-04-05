export const contact = {
  companyName: "Progani GmbH",
  ceo: "Philipp Runge",
  street: "Osterstr. 8",
  postalCode: "20259 Hamburg",
  country: {
    de: "Deutschland",
    en: "Germany",
  },
  email: "kontakt@progani.com",
  get emailHref() {
    return `mailto:${this.email}`;
  },
};
