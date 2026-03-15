export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-primary">MOBA TACTICS</h1>
          <p className="text-muted-foreground mt-2">COMMAND CENTER ACCESS</p>
        </div>
        {children}
      </div>
    </div>
  );
}
