// LoginPage.tsx — M1 implements in H1-2
export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm p-8 border border-border rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-2">TransitOps</h1>
        <p className="text-muted-foreground mb-6 text-sm">Sign in to your account</p>
        {/* TODO M1: login form with Zod validation, JWT storage */}
        <p className="text-sm text-muted-foreground">Login form — implemented in H1-2</p>
      </div>
    </div>
  );
}
