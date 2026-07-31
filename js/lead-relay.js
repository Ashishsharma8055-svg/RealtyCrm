/* =====================================================================
   lead-relay.js  —  website → shared cloud database (Firestore)
   ---------------------------------------------------------------------
   The public site keeps its catalog in "local" mode so it works with zero
   setup. But every captured enquiry (a lead) is ALSO pushed up to the same
   Firebase project the CRM uses, so the CRM at /crm/ can pull it in.

   It writes one document per visitor into the `enquiries` collection, keyed
   by the visitor's lead code (e.g. CND-AB12CD). Re-submissions update the
   same document (merge), so a person viewing several units stays one lead.

   No sign-in needed: firestore.rules allows the public to create/merge an
   enquiry with a constrained shape, but only YOU (signed in) can read them.
   ===================================================================== */
(function () {
  var cfg = (window.APP_CONFIG || {});
  var fb = cfg.firebase;
  var enabled = cfg.leadRelay && fb && fb.apiKey && fb.apiKey !== "YOUR_API_KEY";

  var _db = null, _fs = null, _initPromise = null;

  async function ensure() {
    if (_db) return { db: _db, fs: _fs };
    if (!_initPromise) {
      _initPromise = (async function () {
        var appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
        var fsMod  = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
        // Reuse an already-initialised app if one exists (avoids duplicate-app errors).
        var app;
        try { app = appMod.getApp(); } catch (e) { app = appMod.initializeApp(fb); }
        _db = fsMod.getFirestore(app);
        _fs = fsMod;
        return { db: _db, fs: _fs };
      })();
    }
    return _initPromise;
  }

  // Keep only the whitelisted fields, in a clean/typed form, so the write
  // satisfies the Firestore security rules.
  function sanitise(rec) {
    var out = {
      user:      String(rec.user || "").slice(0, 80),
      mobile:    String(rec.mobile || "").slice(0, 20),
      code:      String(rec.code || "").slice(0, 24),
      status:    String(rec.status || "Open").slice(0, 16),
      createdTs: Number(rec.createdTs || rec.ts || Date.now()),
      ts:        Number(rec.ts || Date.now())
    };
    // interests: [{ project, units:[], firstTs, lastTs }]
    if (Array.isArray(rec.interests)) {
      out.interests = rec.interests.slice(0, 40).map(function (it) {
        return {
          project: String(it.project || "").slice(0, 120),
          units:   Array.isArray(it.units) ? it.units.slice(0, 60).map(function (u) { return String(u).slice(0, 60); }) : [],
          firstTs: Number(it.firstTs || out.ts),
          lastTs:  Number(it.lastTs || out.ts)
        };
      });
    } else {
      out.interests = [];
    }
    if (rec.agent && rec.agent.isAgent) {
      out.agent = {
        isAgent: true,
        firm: String(rec.agent.firm || "").slice(0, 120),
        designation: String(rec.agent.designation || "").slice(0, 80)
      };
    }
    return out;
  }

  async function push(rec) {
    if (!enabled) return;
    try {
      var doc = sanitise(rec);
      if (!doc.mobile || doc.code === "") return;         // nothing useful to store
      var ctx = await ensure();
      var id = doc.code.replace(/[^A-Za-z0-9_-]/g, "") || ("m" + doc.mobile.replace(/\D/g, ""));
      await ctx.fs.setDoc(ctx.fs.doc(ctx.db, "enquiries", id), doc, { merge: true });
    } catch (e) {
      // Never let a relay failure break the on-page experience.
      if (window.console) console.warn("Lead relay skipped:", (e && e.message) || e);
    }
  }

  window.LeadRelay = { enabled: !!enabled, push: push };
})();
