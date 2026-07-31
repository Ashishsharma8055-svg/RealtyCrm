/* =====================================================================
   Firebase configuration  —  coffeeanddeals.in
   The values below are NOT secrets. Firebase web config is meant to be
   public — your data is protected by Firestore Security Rules + Auth.
   NEVER put Admin SDK keys / server secrets in client files.
   =====================================================================*/
window.APP_CONFIG = {
  // Shared Firebase project — the SAME one the CRM (/crm/) uses, so website
  // leads and the CRM read/write one database. This apiKey is public by design;
  // your data is protected by firestore.rules, not by hiding the key.
  firebase: {
    apiKey:            "AIzaSyD1hZIxwgwwfP3d2n869xzkmL2ZmAi-gn4",
    authDomain:        "realtycrm-e2edf.firebaseapp.com",
    projectId:         "realtycrm-e2edf",
    storageBucket:     "realtycrm-e2edf.firebasestorage.app",
    messagingSenderId: "387123468989",
    appId:             "1:387123468989:web:d9d5958e876b59916335d4",
    measurementId:     "G-BRGD1SV0WT"
  },
  // Catalog (projects/inventory/testimonials) stays "local" so the public site
  // works instantly with zero Firestore setup. Captured leads are still sent to
  // the shared cloud database by js/lead-relay.js, so they reach the CRM.
  // Switch to "firebase" later if you want the catalog itself in the cloud too.
  leadRelay: true,          // send website enquiries to the shared cloud DB
  backend: "local",         // "auto" | "local" | "firebase"
  // Real SMS OTP via Firebase Phone Authentication (+ invisible reCAPTCHA).
  // Requires, in the Firebase console for realtycrm-e2edf:
  //   1) Authentication → Sign-in method → Phone → Enable
  //   2) Authentication → Settings → Authorized domains → add your domain
  //      (localhost is already allowed, so Live Server works for testing)
  //   3) For real SMS to any number: upgrade the project to the Blaze plan.
  //      To test the flow WITHOUT sending SMS, add a test number under
  //      Authentication → Sign-in method → Phone → "Phone numbers for testing".
  // Set back to "demo" if you want the old on-screen code instead.
  // "demo" = show the verification code on screen (works instantly, no setup, no SMS
  //          cost). A clean soft-gate that still makes visitors verify a code.
  // "firebase" = real SMS (needs Firebase Phone Auth fully set up + Blaze plan).
  // Launching with "demo" for now; switch to "firebase" later if/when you set up SMS.
  otpMode: "demo",          // "demo" (on-screen code) | "firebase" (real SMS)
  demoOtpFixed: null,       // e.g. "123456" for a fixed demo code, or null for random
  demoAdminPass: "coffee-admin",
  brand: {
    name: "Coffee & Deals",
    tagline: "Real Estate, Brewed with Trust",
    domain: "coffeeanddeals.in",
    owner: "Ashish Sharma",
    ownerTitle: "Deputy General Manager – Sales, BPTP Ltd.",
    phone: "+91 98731 33190",
    email: "ashishsharma8055@gmail.com",
    photo: "assets/ashish.jpg",
    heroImage: "assets/hero-cut.png",
    linkedin: "https://www.linkedin.com/in/sharma-ashish/"
  }
};
