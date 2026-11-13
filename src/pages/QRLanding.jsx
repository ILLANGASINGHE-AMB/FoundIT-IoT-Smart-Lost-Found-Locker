import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function QRLanding() {
  const slug = decodeURIComponent(
    window.location.pathname.split("/").filter(Boolean)[1] || ""
  );

  const [loading, setLoading] = useState(true);
  const [point, setPoint] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCollectionPoint() {
      if (!slug) {
        setError("Invalid QR code.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "log-qr-scan",
        {
          body: { qr_slug: slug },
        }
      );

      if (cancelled) return;

      if (error || !data?.success) {
        setError(data?.error || "This QR code is invalid or inactive.");
      } else {
        setPoint(data.collection_point);
      }

      setLoading(false);
    }

    loadCollectionPoint();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1>FoundIT</h1>

        {loading && <p>Checking QR code...</p>}

        {!loading && error && (
          <p style={styles.error}>{error}</p>
        )}

        {!loading && point && (
          <>
            <h2>Collection Point</h2>
            <h3>{point.name}</h3>
            <p>{point.address || "Address unavailable"}</p>
            <p style={styles.success}>QR code verified successfully.</p>
          </>
        )}
      </div>
    </main>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f3f4f6",
    padding: "20px",
  },
  card: {
    background: "white",
    padding: "30px",
    borderRadius: "14px",
    textAlign: "center",
    maxWidth: "420px",
    width: "100%",
    boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
  },
  error: {
    color: "#dc2626",
  },
  success: {
    color: "#16a34a",
  },
};
