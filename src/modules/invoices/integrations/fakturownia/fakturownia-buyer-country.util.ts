const FAKTUROWNIA_COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  poland: 'PL',
  polska: 'PL',
};

export function normalizeFakturowniaBuyerCountry(country: string): string {
  const trimmed = country.trim();

  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }

  return FAKTUROWNIA_COUNTRY_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}
