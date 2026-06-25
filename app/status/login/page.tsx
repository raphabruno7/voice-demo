export const dynamic = 'force-dynamic';

async function login(formData: FormData) {
  'use server';
  const { cookies } = await import('next/headers');
  const { redirect } = await import('next/navigation');

  const password = formData.get('password') as string;
  const secret = process.env.ADMIN_SECRET;

  if (!secret || password !== secret) {
    redirect('/status/login?error=1');
  }

  const jar = await cookies();
  jar.set('admin_token', secret as string, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });

  redirect('/status');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        background: '#f9fafb',
      }}
    >
      <div
        style={{
          width: 320,
          padding: 32,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24, margin: '0 0 24px' }}>
          Voice Demo — Admin
        </h1>
        {params.error && (
          <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>Password incorrecta.</p>
        )}
        <form action={login}>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Password</label>
          <input
            type="password"
            name="password"
            required
            autoFocus
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            style={{
              marginTop: 16,
              width: '100%',
              padding: '10px',
              background: '#1e3a5f',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
