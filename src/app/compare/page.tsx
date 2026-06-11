import ListingCompareView from '@/components/ListingCompareView';

type PageProps = {
  searchParams: Promise<{ left?: string; right?: string }>;
};

export default async function ComparePage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <ListingCompareView
      initialLeftId={params.left?.trim() || ''}
      initialRightId={params.right?.trim() || ''}
    />
  );
}
