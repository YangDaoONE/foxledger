export type FoxMascotState =
  | "confused"
  | "happy"
  | "listening"
  | "normal"
  | "thinking";

export function FoxMascot({ state }: { state: FoxMascotState }) {
  return (
    <div className={`fox-mascot ${state}`} aria-hidden="true">
      <svg viewBox="0 0 120 108" role="presentation">
        <path className="fox-ear" d="M25 45 20 9l31 25Z" />
        <path className="fox-ear" d="m69 34 31-25-5 36Z" />
        <path className="fox-inner-ear" d="m28 31-4-14 18 16Z" />
        <path className="fox-inner-ear" d="m78 33 18-16-4 14Z" />
        <path className="fox-head" d="M17 42c6-18 22-28 43-28s37 10 43 28c5 16-1 39-15 52-9 8-18 11-28 11s-19-3-28-11C18 81 12 58 17 42Z" />
        <path className="fox-cheek" d="M18 57c12 2 22 8 29 18L30 94C20 83 15 70 18 57Z" />
        <path className="fox-cheek" d="M102 57c-12 2-22 8-29 18l17 19c10-11 15-24 12-37Z" />
        <path className="fox-muzzle" d="M43 71c4-7 10-10 17-10s13 3 17 10c2 7-4 20-17 25-13-5-19-18-17-25Z" />
        {state === "happy" ? (
          <>
            <path className="fox-eye-line" d="M37 55c4-5 8-5 12 0" />
            <path className="fox-eye-line" d="M71 55c4-5 8-5 12 0" />
          </>
        ) : (
          <>
            <circle className="fox-eye" cx="43" cy="54" r="3.5" />
            <circle className="fox-eye" cx="77" cy="54" r="3.5" />
          </>
        )}
        <path className="fox-nose" d="M54 70h12c0 6-3 9-6 9s-6-3-6-9Z" />
        {state === "confused" ? <path className="fox-brow" d="m69 44 15-4" /> : null}
        {state === "confused" ? (
          <text className="fox-question" x="103" y="30">?</text>
        ) : null}
        {state === "happy" ? (
          <>
            <circle className="fox-blush" cx="32" cy="65" r="4" />
            <circle className="fox-blush" cx="88" cy="65" r="4" />
          </>
        ) : null}
        {state === "listening" ? (
          <>
            <path className="fox-signal one" d="M103 38c5 4 7 9 7 15" />
            <path className="fox-signal two" d="M108 31c8 6 11 14 11 23" />
          </>
        ) : null}
        {state === "thinking" ? (
          <>
            <circle className="fox-thought" cx="96" cy="20" r="4" />
            <circle className="fox-thought" cx="107" cy="10" r="6" />
          </>
        ) : null}
      </svg>
    </div>
  );
}
