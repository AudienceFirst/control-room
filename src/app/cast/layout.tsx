export default function CastLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          height: 100% !important;
          width: 100% !important;
          background: black !important;
        }
      `}</style>
      {children}
    </>
  );
}
