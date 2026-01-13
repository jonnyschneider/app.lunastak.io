import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { HomePage } from '@/components/HomePage';

export default async function Page() {
  const session = await getServerSession(authOptions);

  return <HomePage session={session} />;
}
