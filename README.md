# 🚢 CruisePocket - Gestion Médicale & Administrative des Gens de Mer

**CruisePocket** est une Progressive Web App (PWA) conçue pour fluidifier et sécuriser la gestion médicale et administrative des marins de croisière et gens de mer (visites d'aptitude médicale STCW, transmission de dossiers, gestion des passeports et suivi financier).

---

## 🛠️ Stack Technique

* **Frontend :** React 18 + TypeScript + Vite + Tailwind CSS (Thème Maritime & Médical)
* **PWA :** `vite-plugin-pwa`, `manifest.webmanifest`, Service Worker avec stratégie de cache réseau/offline, conformité mobile (iOS & Android)
* **Backend & Temps Réel :** PostgreSQL / Supabase Realtime avec écouteurs en direct et réplication instantanée
* **Stockage :** Bucket Supabase Storage sécurisé (`passports`) acceptant PDF et images
* **Sécurité & Accès :** Authentification par Clés de Licence déterministes et vérifiables (rôles Médecin et Société de Service)

---

## 🏗️ Structure du Projet

```text
CruisePocket/
├── index.html                   # Entrypoint PWA avec balises meta iOS / Mobile
├── package.json                 # Dépendances & scripts de build
├── vite.config.ts               # Configuration Vite + Plugin PWA
├── tailwind.config.js           # Palette Maritime & Medical personnalisée
├── tsconfig.json                # Typage strict TypeScript
├── supabase/
│   └── schema.sql               # Schéma SQL PostgreSQL complet, RLS & Triggers
├── public/
│   ├── logo.svg                 # Logo vectoriel Ancre & Croix Médicale
│   ├── pwa-192x192.png          # Icône PWA mobile
│   ├── pwa-512x512.png          # Icône PWA grand format
│   └── favicon.ico              # Favicon navigateur
└── src/
    ├── main.tsx                 # Racine React avec AuthProvider
    ├── App.tsx                  # Routing principal selon le rôle actif
    ├── index.css                # Styles Tailwind & Glassmorphism
    ├── types/
    │   └── index.ts             # Typages TypeScript (Candidat, Médecin, Société)
    ├── utils/
    │   ├── license.ts           # Générateur & Validateur de Clé de Licence
    │   └── age.ts               # Script de calcul automatique de l'âge
    ├── lib/
    │   └── supabase.ts          # Couche de données (Supabase + Broadcast local)
    ├── context/
    │   └── AuthContext.tsx      # Gestion de session PWA persistante
    └── components/
        ├── common/
        │   └── Header.tsx       # En-tête mobile, statut réseau & bouton PWA
        ├── home/
        │   └── HomePortal.tsx   # Écran d'accueil (2 choix + Générateur de clé)
        ├── company/
        │   └── CompanyDashboard.tsx # Espace Société (Formulaire + Auto-complétion)
        └── doctor/
            ├── DoctorDashboard.tsx  # Tableau de bord Médecin (Temps réel)
            └── FinancialStats.tsx   # Module Bilan Financier & Statistiques
```

---

## 🔑 Système de Clés de Licence

Conformément au cahier des charges, l'accès s'effectue sans mot de passe classique, mais via une **Clé de Licence tokenisée** :

1. **Générateur Société :**
   * Données sources : *Nom de la société*, *Nom/Prénom du responsable*, *Téléphone*, *Localisation*.
   * Format généré : `CP-SOC-[LOC]-[HASH]-[CHECKSUM]` (ex: `CP-SOC-MARS-D4E5F6-7A9B`)

2. **Générateur Médecin :**
   * Données sources : *Nom/Prénom du médecin*, *Numéro d'Ordre*, *Lieu d'exercice*.
   * Format généré : `CP-MED-[ORDRE]-[HASH]-[CHECKSUM]` (ex: `CP-MED-13987-A1B2C3-4E8F`)

---

## 🗄️ Schéma de Base de Données (`supabase/schema.sql`)

* `public.service_companies` : Sociétés de crewing / agences partenaires.
* `public.doctors` : Médecins agréés gens de mer.
* `public.cruise_companies` : Compagnies de croisière. **Auto-alimentée** par trigger PostgreSQL lors de toute nouvelle saisie.
* `public.candidates` : Dossiers des gens de mer (état civil, âge calculé, passeport, poste, statut médical "En instance" / "Effectué", montant financier, payeur).
* `storage.buckets` (`passports`) : Stockage sécurisé des copies de passeports.

---

## 🚀 Démarrage Rapide

1. **Lancer le serveur de développement :**
   ```bash
   npm run dev
   ```

2. **Compiler pour la production :**
   ```bash
   npm run build
   ```

3. **Tester la PWA :**
   Ouvrez le lien local dans Safari ou Chrome mobile, puis cliquez sur "Ajouter à l'écran d'accueil" ou le bouton d'installation de la barre supérieure.
