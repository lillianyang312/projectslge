'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { getPublicUrl } from '@/services/imageService';
import type { Item } from '@/types/models';

export interface TopBidInfo {
  topBid: number | undefined;
  interestedCount: number;
  dealStatus?: 'pending' | 'sold';
}

interface ItemCardProps {
  item: Item;
  topBid?: TopBidInfo;
}

function formatPrice(min?: number, max?: number): string {
  if (min && max) return `$${min} – $${max}`;
  if (min) return `$${min}+`;
  if (max) return `Up to $${max}`;
  return 'Price TBD';
}

const conditionLabels: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export default function ItemCard({ item, topBid }: ItemCardProps): React.ReactElement {
  const photoPath = item.photos?.[0] || item.image_path;
  const imageUrl = photoPath ? getPublicUrl(photoPath) : null;
  const hasBid: boolean = !!topBid?.topBid;
  const isSold = topBid?.dealStatus === 'sold';
  const isPending = topBid?.dealStatus === 'pending';

  return (
    <Link href={`/items/${item.id}`} className="group block">
      <div className={`overflow-hidden rounded-md border bg-card shadow-sm transition-shadow group-hover:shadow-lg ${
        isSold ? 'border-neutral-300 opacity-75' : isPending ? 'border-purple-300' : 'border-border'
      }`}>
        <div className="relative aspect-square bg-accent-soft">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.title || 'Item'}
              className={`h-full w-full object-cover ${isSold ? 'grayscale' : ''}`}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl text-text-muted">
              {item.label || '📦'}
            </div>
          )}

          {/* Status badge */}
          {isSold && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded bg-neutral-600 px-3 py-1 text-sm font-bold tracking-widest text-white">SOLD</span>
            </div>
          )}
          {isPending && !isSold && (
            <div className="absolute top-1.5 left-1.5 rounded bg-purple-600/90 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              Pending
            </div>
          )}

          {/* Retail price badge — top right */}
          {item.retail_price && !isSold && (
            <div className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              Retail: ${item.retail_price}
            </div>
          )}

          {/* Top bid overlay badge */}
          {hasBid && !isSold && (
            <div className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              Top bid: ${topBid!.topBid}
            </div>
          )}

        </div>
        <div className="p-md">
          <h3 className="truncate text-sm font-medium text-text-primary">
            {item.title || 'Untitled Item'}
          </h3>
          <div className="mt-xs flex flex-wrap gap-xs">
            {item.category && <Badge variant="neutral">{item.category}</Badge>}
            {item.condition && (
              <Badge variant="info">{conditionLabels[item.condition] || item.condition}</Badge>
            )}
          </div>
          <div className="mt-sm flex items-center gap-sm">
            <p className="font-heading text-md font-medium text-text-primary">
              {formatPrice(item.estimated_value_min || item.market_value_min, item.estimated_value_max || item.market_value_max)}
            </p>
            {topBid && topBid.interestedCount > 0 && (
              <span className="text-xs text-text-muted">{topBid.interestedCount} interested</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
