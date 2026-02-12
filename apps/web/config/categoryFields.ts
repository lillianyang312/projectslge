export interface CategoryField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  options?: string[];
  placeholder?: string;
  unit?: string;
}

export const CATEGORY_FIELDS: Record<string, CategoryField[]> = {
  'Electronics': [
    { key: 'itemType', label: 'Item type', type: 'select', required: true, options: ['Phone', 'Laptop', 'Tablet', 'TV', 'Camera', 'Gaming console', 'Audio equipment', 'Other'], placeholder: 'Select type' },
    { key: 'brand', label: 'Brand', type: 'text', required: true, placeholder: 'e.g. Apple, Samsung, Sony' },
    { key: 'model', label: 'Model', type: 'text', required: true, placeholder: 'e.g. iPhone 14, Galaxy S23' },
    { key: 'workingStatus', label: 'Working status', type: 'select', required: true, options: ['Fully functional', 'Minor issues', 'Not working', 'Unknown'], placeholder: 'Select status' },
  ],
  'Furniture': [
    { key: 'furnitureType', label: 'Furniture type', type: 'select', required: true, options: ['Sofa/Couch', 'Chair', 'Table', 'Desk', 'Bed/Mattress', 'Dresser', 'Shelf/Bookcase', 'Outdoor furniture', 'Other'], placeholder: 'Select type' },
    { key: 'material', label: 'Material', type: 'select', required: true, options: ['Wood', 'Metal', 'Fabric', 'Leather', 'Glass', 'Plastic', 'Mixed/Other'], placeholder: 'Select material' },
  ],
  'Clothing & Accessories': [
    { key: 'itemType', label: 'Item type', type: 'select', required: true, options: ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Bags', 'Jewelry', 'Watches', 'Other accessories'], placeholder: 'Select type' },
    { key: 'size', label: 'Size', type: 'select', required: true, options: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size', 'Numeric (see notes)'], placeholder: 'Select size' },
    { key: 'brand', label: 'Brand', type: 'text', required: false, placeholder: 'e.g. Nike, Zara, Gucci' },
    { key: 'material', label: 'Material', type: 'text', required: false, placeholder: 'e.g. Cotton, Leather, Wool' },
  ],
  'Sports Equipment': [
    { key: 'itemType', label: 'Item type', type: 'select', required: true, options: ['Fitness equipment', 'Ball sports', 'Water sports', 'Winter sports', 'Camping/Hiking gear', 'Other'], placeholder: 'Select type' },
    { key: 'sport', label: 'Sport', type: 'text', required: true, placeholder: 'e.g. Tennis, Skiing, Yoga' },
    { key: 'size', label: 'Size', type: 'text', required: false, placeholder: 'e.g. Medium, 155cm, 10.5' },
    { key: 'conditionNotes', label: 'Condition notes', type: 'text', required: false, placeholder: 'e.g. Light scratches on base' },
  ],
  'Mobility & Rideables': [
    { key: 'itemType', label: 'Item type', type: 'select', required: true, options: ['Bicycle', 'Electric bike', 'Scooter', 'Electric scooter', 'Skateboard', 'Hoverboard', 'Other'], placeholder: 'Select type' },
    { key: 'powerType', label: 'Power type', type: 'select', required: true, options: ['Manual/Human-powered', 'Electric', 'Gas-powered'], placeholder: 'Select power type' },
    { key: 'workingStatus', label: 'Working status', type: 'select', required: true, options: ['Fully functional', 'Minor issues', 'Needs repair', 'Not working'], placeholder: 'Select status' },
  ],
  'Kitchen & Home': [
    { key: 'itemType', label: 'Item type', type: 'select', required: true, options: ['Small appliance', 'Large appliance', 'Cookware', 'Dinnerware', 'Decor', 'Storage', 'Linens', 'Other'], placeholder: 'Select type' },
    { key: 'material', label: 'Material', type: 'select', required: false, options: ['Metal', 'Plastic', 'Glass', 'Ceramic', 'Wood', 'Fabric', 'Other'], placeholder: 'Select material' },
    { key: 'damagePresent', label: 'Damage present', type: 'select', required: true, options: ['None', 'Minor scratches/wear', 'Chips/cracks', 'Stains', 'Multiple issues'], placeholder: 'Select damage level' },
  ],
  'Books & Media': [
    { key: 'format', label: 'Format', type: 'select', required: true, options: ['Hardcover book', 'Paperback book', 'Vinyl record', 'CD', 'DVD/Blu-ray', 'Video game', 'Other'], placeholder: 'Select format' },
    { key: 'authorArtist', label: 'Author/Artist', type: 'text', required: true, placeholder: 'e.g. Stephen King, The Beatles' },
    { key: 'publicationYear', label: 'Publication year', type: 'number', required: false, placeholder: 'e.g. 2020' },
    { key: 'conditionNotes', label: 'Condition notes', type: 'text', required: false, placeholder: 'e.g. First edition, minor shelf wear' },
  ],
  'Collectibles': [
    { key: 'collectibleType', label: 'Collectible type', type: 'select', required: true, options: ['Art/Prints', 'Antiques', 'Trading cards', 'Coins/Currency', 'Toys/Figures', 'Memorabilia', 'Other'], placeholder: 'Select type' },
    { key: 'makerBrand', label: 'Maker/Brand', type: 'text', required: false, placeholder: 'e.g. Pokemon, Funko, Vintage' },
    { key: 'material', label: 'Material', type: 'text', required: false, placeholder: 'e.g. Paper, Metal, Porcelain' },
    { key: 'markingsPresent', label: 'Markings present', type: 'select', required: false, options: ['Yes - signature/stamp', 'Yes - serial number', 'Yes - other markings', 'No visible markings'], placeholder: 'Select markings' },
  ],
  'Tickets': [
    { key: 'eventType', label: 'Event type', type: 'select', required: true, options: ['Concert', 'Sports', 'Theater', 'Festival', 'Comedy', 'Conference', 'Other'], placeholder: 'Select event type' },
    { key: 'eventName', label: 'Event name', type: 'text', required: true, placeholder: 'e.g. Taylor Swift Eras Tour' },
    { key: 'eventDate', label: 'Event date', type: 'text', required: true, placeholder: 'e.g. March 15, 2026' },
    { key: 'venue', label: 'Venue', type: 'text', required: false, placeholder: 'e.g. TD Garden, Boston' },
    { key: 'quantity', label: 'Number of tickets', type: 'number', required: true, placeholder: 'e.g. 2' },
  ],
  'Other': [
    { key: 'itemType', label: 'Item type', type: 'text', required: true, placeholder: 'Describe the type of item' },
    { key: 'brand', label: 'Brand', type: 'text', required: false, placeholder: 'e.g. Brand name (if applicable)' },
  ],
  'Generic': [
    { key: 'brand', label: 'Brand', type: 'text', required: false, placeholder: 'e.g. Brand name (if applicable)' },
  ],
};

export function getCategoryFields(category: string): CategoryField[] {
  if (CATEGORY_FIELDS[category]) return CATEGORY_FIELDS[category];

  const lowerCategory = category.toLowerCase();
  for (const [key, fields] of Object.entries(CATEGORY_FIELDS)) {
    if (key.toLowerCase() === lowerCategory) return fields;
  }
  for (const [key, fields] of Object.entries(CATEGORY_FIELDS)) {
    if (lowerCategory.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerCategory)) return fields;
  }
  return CATEGORY_FIELDS['Generic'];
}

export function getAllCategories(): string[] {
  return Object.keys(CATEGORY_FIELDS).filter((cat) => cat !== 'Generic');
}

export function validateCategoryFields(
  category: string,
  fieldValues: Record<string, unknown>
): { isValid: boolean; missingFields: string[] } {
  const fields = getCategoryFields(category);
  const missingFields: string[] = fields
    .filter((f) => f.required && (fieldValues[f.key] === undefined || fieldValues[f.key] === null || fieldValues[f.key] === ''))
    .map((f) => f.label);
  return { isValid: missingFields.length === 0, missingFields };
}
