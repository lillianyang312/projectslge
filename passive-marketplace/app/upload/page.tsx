'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Category } from '@/lib/types'
import { saveUpload, generateId, getProfile, saveItem, saveWant } from '@/lib/store'

const categories: Category[] = ['Electronics', 'Furniture', 'Clothing', 'Books', 'Kitchen', 'Sports', 'Collectibles', 'Other']

const fakeClassifier = (filename: string, caption: string): {title: string, category?: Category} => {
  const text = (filename + ' ' + caption).toLowerCase()
  if (text.includes('iphone') || text.includes('phone')) return {title: 'iPhone', category: 'Electronics'}
  if (text.includes('laptop') || text.includes('macbook')) return {title: 'Laptop', category: 'Electronics'}
  if (text.includes('desk') || text.includes('table')) return {title: 'Desk', category: 'Furniture'}
  if (text.includes('bike') || text.includes('bicycle')) return {title: 'Bike', category: 'Sports'}
  if (text.includes('book')) return {title: 'Book', category: 'Books'}
  if (text.includes('jacket') || text.includes('coat')) return {title: 'Jacket', category: 'Clothing'}
  if (text.includes('chair')) return {title: 'Chair', category: 'Furniture'}
  if (text.includes('ipad') || text.includes('tablet')) return {title: 'Tablet', category: 'Electronics'}
  return {title: 'Item', category: undefined}
}

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [caption, setCaption] = useState('')
  const [detected, setDetected] = useState<{title: string, category?: Category} | null>(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedCategory, setEditedCategory] = useState<Category | ''>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setFile(f)

      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(f)

      const result = fakeClassifier(f.name, caption)
      setDetected(result)
      setEditedTitle(result.title)
      setEditedCategory(result.category || '')
    }
  }

  const handleAddToList = () => {
    const profile = getProfile()
    if (!profile) {
      alert('Please set up your profile first')
      router.push('/profile')
      return
    }

    const upload = {
      id: generateId(),
      userId: profile.userId,
      imageUrl: preview,
      detectedTitle: detected?.title || '',
      detectedCategory: detected?.category,
      userEditedTitle: editedTitle,
      userEditedCategory: editedCategory as Category | undefined,
      createdAt: Date.now(),
      addedToListOrWant: 'list' as const,
    }
    saveUpload(upload)

    const item = {
      id: generateId(),
      userId: profile.userId,
      name: editedTitle || detected?.title || 'Item',
      category: (editedCategory || detected?.category) as Category | undefined,
      wouldLetGoForUnsure: true,
      likelihoodToSell: 'if good offer' as const,
      isSpecialCollectible: false,
      shippingPreference: 'local only' as const,
      imageUrl: preview,
      createdAt: Date.now(),
    }
    saveItem(item)

    router.push('/list')
  }

  const handleAddToWants = () => {
    const profile = getProfile()
    if (!profile) {
      alert('Please set up your profile first')
      router.push('/profile')
      return
    }

    const upload = {
      id: generateId(),
      userId: profile.userId,
      imageUrl: preview,
      detectedTitle: detected?.title || '',
      detectedCategory: detected?.category,
      userEditedTitle: editedTitle,
      userEditedCategory: editedCategory as Category | undefined,
      createdAt: Date.now(),
      addedToListOrWant: 'want' as const,
    }
    saveUpload(upload)

    const want = {
      id: generateId(),
      userId: profile.userId,
      name: editedTitle || detected?.title || 'Item',
      category: (editedCategory || detected?.category) as Category | undefined,
      urgency: 'interested' as const,
      isGeneralInterest: false,
      shippingPreference: 'shipping ok' as const,
      createdAt: Date.now(),
      lastInteractionAt: Date.now(),
    }
    saveWant(want)

    router.push('/wants')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-medium text-foreground">Upload Item</h1>
        <p className="text-sm text-muted-foreground mt-1">Add item by photo</p>
      </div>

      <div className="border-2 border-dashed border-border rounded-lg p-12 text-center mb-6 hover:border-foreground transition-colors">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
        />
        <label htmlFor="file-input" className="cursor-pointer block">
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded mb-2" />
          ) : null}
          {file ? (
            <p className="text-foreground text-sm">{file.name}</p>
          ) : (
            <p className="text-muted-foreground">Drop image or click to upload</p>
          )}
        </label>
      </div>

      <div className="mb-6">
        <label className="block text-sm text-muted-foreground mb-1">
          Caption (optional, helps detection)
        </label>
        <input
          type="text"
          value={caption}
          onChange={e => {
            setCaption(e.target.value)
            if (file) {
              const result = fakeClassifier(file.name, e.target.value)
              setDetected(result)
              setEditedTitle(result.title)
              setEditedCategory(result.category || '')
            }
          }}
          className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="e.g., iPhone 12, black"
        />
      </div>

      {detected && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Detected title</label>
            <input
              type="text"
              value={editedTitle}
              onChange={e => setEditedTitle(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Category</label>
            <select
              value={editedCategory}
              onChange={e => setEditedCategory(e.target.value as Category)}
              className="w-full px-3 py-2 border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select...</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAddToList}
              className="flex-1 py-3 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
            >
              Add to My List
            </button>
            <button
              onClick={handleAddToWants}
              className="flex-1 py-3 border border-border rounded hover:bg-secondary transition-colors"
            >
              Add to My Wants
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
