import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-muted-foreground text-sm uppercase tracking-wider">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        The fund or page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link className="underline underline-offset-2" href="/">
        Back to home
      </Link>
    </main>
  );
}
