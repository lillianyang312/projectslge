'use client'

import { useState, useEffect } from 'react'
import type { Item } from '@/lib/types'
import { getItems, saveItem, deleteItem, getProfile, generateId } from '@/lib/store'
import ItemRow from '@/components/ItemRow'
import ItemModal from '@/components/ItemModal'

export default function ListPage() {
  const [items, setItems] = useState<Item[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | undefined>()
  const [profile, setProfile] = useState(getProfile())

  useEffect(() => {
    setItems(getItems())
    setProfile(getProfile())
  }, [])

  const handleSave = (itemData: Partial<Item>) => {
    if (!profile) {
      alert('Please set up your profile first')
      return
    }

    const item: Item = editingItem
      ? { ...editingItem, ...itemData }
      : {
          id: generateId(),
          userId: profile.userId,
          createdAt: Date.now(),
          wouldLetGoForUnsure: false,
          likelihoodToSell: 'if good offer',
          isSpecialCollectible: false,
          shippingPreference: 'local only',
          ...itemData,
        } as Item

    saveItem(item)
    setItems(getItems())
    setShowModal(false)
    setEditingItem(undefined)
  }

  const handleEdit = (item: Item) => {
    setEditingItem(item)
    setShowModal(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this item?')) {
      deleteItem(id)
      setItems(getItems())
    }
  }

  const handleAdd = () => {
    if (!profile) {
      alert('Please set up your profile first')
      return
    }
    setEditingItem(undefined)
    setShowModal(true)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="sticky top-0 bg-background border-b border-border px-4 py-4">
        <h1 className="text-xl font-medium text-foreground">My List</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Items you own and might let go
        </p>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-muted-foreground mb-6">
            No items yet. Add items from your closet, kitchen, unused tech...
          </p>
          <button
            onClick={handleAdd}
            className="px-6 py-2 bg-foreground text-background rounded hover:bg-foreground/90 transition-colors font-medium"
          >
            Add first item
          </button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center"
                onContextMenu={e => {
                  e.preventDefault()
                  if (confirm('Delete this item?')) {
                    handleDelete(item.id)
                  }
                }}
              >
                <div className="flex-1">
                  <ItemRow item={item} onClick={() => handleEdit(item)} />
                </div>
              </div>
            ))}
          </div>
          <div className="p-4">
            <button
              onClick={handleAdd}
              className="w-full py-3 border-2 border-dashed border-border rounded text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              Add item
            </button>
          </div>
        </>
      )}

      {!profile && (
        <div className="fixed bottom-20 left-0 right-0 mx-4 p-4 bg-secondary border border-border rounded-lg">
          <p className="text-sm text-foreground mb-2">Set up your profile first</p>
          <a
            href="/profile"
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Go to Profile
          </a>
        </div>
      )}

      {showModal && (
        <ItemModal
          item={editingItem}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false)
            setEditingItem(undefined)
          }}
        />
      )}
    </div>
  )
}
