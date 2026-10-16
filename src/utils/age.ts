/**
 * Calcul précis de l'âge à partir de la date de naissance (format YYYY-MM-DD ou objet Date)
 * Prise en compte exacte des mois et jours révolus.
 */
export function calculateAge(birthDateInput: string | Date): number | null {
  if (!birthDateInput) return null;

  const birthDate = typeof birthDateInput === 'string' 
    ? new Date(birthDateInput) 
    : birthDateInput;

  if (isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

/**
 * Validation de l'âge pour les gens de mer (convention STCW / travail maritime)
 * Âge minimum légal : généralement 18 ans pour embarquement international
 */
export function validateMaritimeAge(age: number | null): {
  isValid: boolean;
  message?: string;
} {
  if (age === null) {
    return { isValid: false, message: 'Date de naissance requise' };
  }
  if (age < 16) {
    return { isValid: false, message: 'Âge minimum légal non atteint (< 16 ans)' };
  }
  if (age < 18) {
    return { isValid: true, message: 'Attention : Candidat mineur (< 18 ans, restrictions de quart de nuit)' };
  }
  if (age > 75) {
    return { isValid: true, message: 'Vérifier aptitude physique renforcée (> 75 ans)' };
  }
  return { isValid: true };
}
