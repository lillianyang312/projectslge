import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PageContainer from '@/components/layout/PageContainer';
import { Avatar, Badge, Card } from '@/components/ui';

interface UserProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function UserProfilePage({ params }: UserProfilePageProps): Promise<React.ReactElement> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, first_name, house, graduation_year, rating, rating_count, sales_completed, purchases_completed, created_at, payment_preference')
    .eq('id', id)
    .single();

  if (!profile) notFound();

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const paymentMethods: string[] = profile.payment_preference?.split(',').filter(Boolean) || [];

  return (
    <PageContainer className="max-w-2xl">
      <Card className="mb-xl">
        <div className="flex items-center gap-xl">
          <Avatar name={profile.full_name} size="lg" />
          <div>
            <h1 className="font-heading text-h2 text-text-primary">{profile.full_name}</h1>
            {profile.graduation_year && (
              <p className="text-sm text-text-secondary">Class of {profile.graduation_year}</p>
            )}
            <p className="mt-xs text-sm text-text-muted">Member since {memberSince}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-lg sm:grid-cols-2">
        {(profile.house || profile.graduation_year) && (
          <Card>
            <h3 className="text-sm font-medium text-text-secondary">Harvard Info</h3>
            <div className="mt-md space-y-sm">
              {profile.graduation_year && (
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">Class of</span>
                  <span className="text-sm font-medium text-text-primary">{profile.graduation_year}</span>
                </div>
              )}
              {profile.house && (
                <div className="flex justify-between">
                  <span className="text-sm text-text-muted">House</span>
                  <span className="text-sm font-medium text-text-primary">{profile.house}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card>
          <h3 className="text-sm font-medium text-text-secondary">Stats</h3>
          <div className="mt-md space-y-sm">
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Rating</span>
              <span className="text-sm font-medium text-text-primary">
                {profile.rating ? `${profile.rating.toFixed(1)} / 5` : 'No ratings yet'}
                {profile.rating_count > 0 && ` (${profile.rating_count})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Sales</span>
              <span className="text-sm font-medium text-text-primary">{profile.sales_completed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Purchases</span>
              <span className="text-sm font-medium text-text-primary">{profile.purchases_completed}</span>
            </div>
          </div>
        </Card>
      </div>

      {paymentMethods.length > 0 && (
        <Card className="mt-lg">
          <h3 className="text-sm font-medium text-text-secondary">Accepts</h3>
          <div className="mt-md flex flex-wrap gap-sm">
            {paymentMethods.map((m) => (
              <Badge key={m} variant="neutral">{m}</Badge>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
