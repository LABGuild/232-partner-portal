'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ClassifiedActions({ classifiedId }: { classifiedId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('classifieds').delete().eq('id', classifiedId)
    if (error) {
      setDeleting(false)
      alert(`Could not delete: ${error.message}`)
      return
    }
    router.push('/classifieds')
  }

  return (
    <div className="flex items-center gap-2">
      <Link href={`/classifieds/${classifiedId}/edit`} className="btn-secondary text-sm">
        Edit
      </Link>
      {confirming ? (
        <>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm font-heading font-semibold text-white bg-brand-red px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Confirm delete'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="text-sm font-heading font-semibold text-brand-red border-2 border-brand-red px-4 py-2 rounded-lg hover:bg-brand-red hover:text-white transition-colors"
        >
          Delete
        </button>
      )}
    </div>
  )
}
