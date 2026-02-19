'use client';

import { useState, useEffect, useCallback } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import ItemCard from '@/components/items/ItemCard';
import type { TopBidInfo } from '@/components/items/ItemCard';
import { Pill, Spinner, EmptyState } from '@/components/ui';
import { getAllItems } from '@/services/itemsService';
import { getTopBidsForItems } from '@/services/dealsService';
import { semanticSearch, type SearchResultItem } from '@/services/searchService';
import { getAllCategories } from '@/config/categoryFields';
import { useAuthStore } from '@/stores/authStore';
import type { Item } from '@/types/models';

export default function BrowsePage(): React.ReactElement {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<Item[]>([]);
  const [topBids, setTopBids] = useState<Record<string, TopBidInfo>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [searching, setSearching] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [interpretation, setInterpretation] = useState<string>('');

  const categories = getAllCategories();

  const loadItems = useCallback(async (): Promise<void> => {
    setLoading(true);
    const { data } = await getAllItems();
    setItems(data);

    /* Fetch top bids for all browse items */
    if (data.length > 0) {
      const ids: string[] = data.map((i) => i.id);
      const bids: Record<string, TopBidInfo> = await getTopBidsForItems(ids);
      setTopBids(bids);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      setInterpretation('');
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const response = await semanticSearch(query, 20, user?.id);
      setSearchResults(response.results);
      setInterpretation(response.interpretation);
      /* Fetch top bids for search results */
      if (response.results.length > 0) {
        const ids = response.results.map((r) => r.id);
        const bids: Record<string, TopBidInfo> = await getTopBidsForItems(ids);
        setTopBids((prev) => ({ ...prev, ...bids }));
      }
      setSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, user?.id]);

  const displayItems = searchResults
    ? searchResults.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        condition: r.condition,
        retail_price: r.retailPrice,
        photos: r.photos,
        estimated_value_min: r.priceMin,
        estimated_value_max: r.priceMax,
        label: r.emoji,
      } as Item))
    : selectedCategory
    ? items.filter((i) => i.category?.toLowerCase() === selectedCategory.toLowerCase())
    : items;

  return (
    <PageContainer>
      <div className="mb-2xl">
        <h1 className="font-heading text-h1 text-text-primary">Browse</h1>
        <p className="mt-xs text-md text-text-secondary">
          Find items from fellow Harvard students
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-xl">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for items... (e.g. desk lamp, winter jacket)"
            className="w-full rounded-md border border-border bg-card px-lg py-md pl-10 text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <span className="absolute left-md top-1/2 -translate-y-1/2 text-text-muted">
            &#128269;
          </span>
          {searching && (
            <div className="absolute right-md top-1/2 -translate-y-1/2">
              <Spinner size="sm" />
            </div>
          )}
        </div>
        {interpretation && (
          <p className="mt-sm text-sm text-text-secondary italic">{interpretation}</p>
        )}
      </div>

      {/* Category filters */}
      {!searchResults && (
        <div className="mb-xl flex flex-wrap gap-sm">
          <Pill selected={!selectedCategory} onClick={() => setSelectedCategory('')}>
            All
          </Pill>
          {categories.map((cat) => (
            <Pill
              key={cat}
              selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
            >
              {cat}
            </Pill>
          ))}
        </div>
      )}

      {/* Items grid */}
      {loading ? (
        <div className="flex justify-center py-huge">
          <Spinner size="lg" />
        </div>
      ) : displayItems.length === 0 ? (
        <EmptyState
          title={searchResults ? 'No results found' : 'No items yet'}
          description={
            searchResults
              ? 'Try a different search term'
              : 'Check back soon — students are listing items every day!'
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-lg sm:grid-cols-3 lg:grid-cols-4">
          {displayItems.map((item) => (
            <ItemCard key={item.id} item={item} topBid={topBids[item.id]} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
