export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">FoxLedger</p>
        <h1>狐狐记账</h1>
        <p className="intro">
          自用 AI 记账 App，当前已完成第 1 阶段项目骨架。
        </p>
        <div className="stage-status" aria-label="current project stage">
          <span>Stage 1</span>
          <strong>Next.js + TypeScript skeleton is ready.</strong>
        </div>
      </section>
    </main>
  );
}
