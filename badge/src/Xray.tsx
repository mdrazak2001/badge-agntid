import type { ContentsKind, ScanVerdict } from "./types";

type Props = {
  kind: ContentsKind;
  verdict: ScanVerdict;
};

export function Xray({ kind, verdict }: Props) {
  const stroke = verdict === "deny" ? "var(--alarm)" : "var(--phosphor)";
  return (
    <svg className="xray" viewBox="0 0 220 140" aria-hidden="true">
      {kind === "papers" && (
        <>
          <rect x="58" y="28" width="72" height="88" rx="2" />
          <rect x="92" y="38" width="72" height="88" rx="2" />
          <path d="M100 56h48M100 70h40M100 84h44M100 98h28" />
        </>
      )}
      {kind === "aggregates" && (
        <>
          <path d="M40 110h140" />
          <rect x="52" y="72" width="18" height="38" />
          <rect x="86" y="48" width="18" height="62" />
          <rect x="120" y="60" width="18" height="50" />
          <rect x="154" y="84" width="18" height="26" />
        </>
      )}
      {kind === "pii" && (
        <>
          <rect x="46" y="42" width="128" height="22" rx="2" />
          <rect x="46" y="74" width="128" height="22" rx="2" />
          <circle cx="62" cy="53" r="5" />
          <circle cx="62" cy="85" r="5" />
          <path d="M76 53h80M76 85h64" />
        </>
      )}
      {kind === "secret" && (
        <>
          <circle cx="86" cy="70" r="22" />
          <path d="M106 70h62v10H128l-6 18h-12l6-18" />
        </>
      )}
      {kind === "transmitter" && (
        <>
          <rect x="96" y="64" width="28" height="40" rx="2" />
          <path d="M110 64V28M90 44c12-16 28-16 40 0M78 32c20-24 44-24 64 0" />
          <circle cx="110" cy="26" r="4" />
        </>
      )}
      {kind === "browser" && (
        <>
          <rect x="42" y="32" width="136" height="86" rx="3" />
          <path d="M42 50h136" />
          <circle cx="54" cy="41" r="3" />
          <circle cx="66" cy="41" r="3" />
          <path d="M58 68h48M58 82h72M58 96h36" />
        </>
      )}
      <style>{`
        .xray { width: 100%; height: 100%; }
        .xray * {
          fill: none;
          stroke: ${stroke};
          stroke-width: 1.6;
          stroke-linecap: square;
        }
      `}</style>
    </svg>
  );
}
