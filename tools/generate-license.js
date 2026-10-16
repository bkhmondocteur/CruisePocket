#!/usr/bin/env node
/**
 * CruisePocket - Outil Administrateur Hors-Ligne de Génération de Licences
 * 
 * Usage:
 *   node tools/generate-license.js medecin "Dr. Nom Prénom" "13/98745" "Marseille"
 *   node tools/generate-license.js societe "Nom Société" "Nom Responsable" "+33 4 00 00 00" "Marseille"
 */

function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

function generateChecksum(prefix, seed) {
  const combined = `${prefix}:${seed}:CRUISE_POCKET_SALT_2026`;
  return hashString(combined).substring(0, 4);
}

function generateCompanyLicense(name, managerName, phone, location) {
  const cleanName = name.trim();
  const cleanManager = managerName.trim();
  const cleanPhone = phone.trim();
  const cleanLocation = location.trim();

  const locSlug = (cleanLocation.replace(/[^a-zA-Z]/g, '').substring(0, 4) || 'PORT').toUpperCase().padEnd(4, 'X');
  const rawData = `${cleanName.toLowerCase()}|${cleanManager.toLowerCase()}|${cleanPhone}|${cleanLocation.toLowerCase()}`;
  const coreHash = hashString(rawData).substring(0, 6);
  const checksum = generateChecksum('CP-SOC', `${locSlug}-${coreHash}`);

  const licenseKey = `CP-SOC-${locSlug}-${coreHash}-${checksum}`;
  return {
    role: 'Société de Service',
    licenseKey,
    details: { name: cleanName, manager: cleanManager, phone: cleanPhone, location: cleanLocation }
  };
}

function generateDoctorLicense(fullName, orderNumber, practiceLocation) {
  const cleanName = fullName.trim();
  const cleanOrder = orderNumber.trim().replace(/[^a-zA-Z0-9]/g, '');
  const cleanLocation = practiceLocation.trim();

  const orderSlug = cleanOrder.substring(0, 5).toUpperCase().padEnd(5, '0');
  const rawData = `${cleanName.toLowerCase()}|${cleanOrder}|${cleanLocation.toLowerCase()}`;
  const coreHash = hashString(rawData).substring(0, 6);
  const checksum = generateChecksum('CP-MED', `${orderSlug}-${coreHash}`);

  const licenseKey = `CP-MED-${orderSlug}-${coreHash}-${checksum}`;
  return {
    role: 'Médecin Agréé',
    licenseKey,
    details: { fullName: cleanName, orderNumber, location: cleanLocation }
  };
}

const args = process.argv.slice(2);
const type = args[0]?.toLowerCase();

if (type === 'medecin') {
  const [_, name, order, location] = args;
  if (!name || !order || !location) {
    console.log('\n❌ Usage: node tools/generate-license.js medecin <Nom/Prénom> <Numéro Ordre> <Lieu exercice>');
    console.log('Exemple: node tools/generate-license.js medecin "Dr. Philippe DUPONT" "75/12345" "Paris"\n');
    process.exit(1);
  }
  const result = generateDoctorLicense(name, order, location);
  console.log('\n✅ LICENCE MÉDECIN GÉNÉRÉE AVEC SUCCÈS :');
  console.log('----------------------------------------------------');
  console.log(`Clé de Licence : ${result.licenseKey}`);
  console.log(`Médecin        : ${result.details.fullName}`);
  console.log(`N° d'Ordre     : ${result.details.orderNumber}`);
  console.log(`Lieu           : ${result.details.location}`);
  console.log('----------------------------------------------------\n');
} else if (type === 'societe') {
  const [_, name, manager, phone, location] = args;
  if (!name || !manager || !phone || !location) {
    console.log('\n❌ Usage: node tools/generate-license.js societe <Nom Société> <Responsable> <Téléphone> <Localisation>');
    console.log('Exemple: node tools/generate-license.js societe "Azur Crewing" "Marc V." "+33491000000" "Marseille"\n');
    process.exit(1);
  }
  const result = generateCompanyLicense(name, manager, phone, location);
  console.log('\n✅ LICENCE SOCIÉTÉ GÉNÉRÉE AVEC SUCCÈS :');
  console.log('----------------------------------------------------');
  console.log(`Clé de Licence : ${result.licenseKey}`);
  console.log(`Société        : ${result.details.name}`);
  console.log(`Responsable    : ${result.details.manager}`);
  console.log(`Téléphone      : ${result.details.phone}`);
  console.log(`Localisation   : ${result.details.location}`);
  console.log('----------------------------------------------------\n');
} else {
  console.log('\n⚓ CruisePocket - Générateur Administratif de Licences');
  console.log('----------------------------------------------------');
  console.log('Usage :');
  console.log('  Pour un Médecin :');
  console.log('    node tools/generate-license.js medecin "<Nom/Prénom>" "<N° Ordre>" "<Lieu>"');
  console.log('  Pour une Société :');
  console.log('    node tools/generate-license.js societe "<Société>" "<Responsable>" "<Téléphone>" "<Lieu>"');
  console.log('----------------------------------------------------\n');
}
