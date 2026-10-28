"use client";

export default function AssetSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-2xl items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold text-destructive">Asset records unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold">We couldn’t load asset information</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please try again. If this keeps happening, contact your administrator and share the reference below.
        </p>
        {error.digest && <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
