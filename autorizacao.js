export const EMAILS_POR_FACULDADE = {
  "facee@unirovuma.ac.mz": "FACEE",
  "fcsf@unirovuma.ac.mz": "FCSF",
  "fct@unirovuma.ac.mz": "FCT",
  "fd@unirovuma.ac.mz": "FD",
  "dc@unirovuma.ac.mz": "DC"
};

export const EMAILS_PERMITIDOS = Object.keys(EMAILS_POR_FACULDADE);

export function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function emailAutorizado(email) {
  return EMAILS_PERMITIDOS.includes(normalizarEmail(email));
}

export function faculdadePorEmail(email) {
  return EMAILS_POR_FACULDADE[normalizarEmail(email)];
}
