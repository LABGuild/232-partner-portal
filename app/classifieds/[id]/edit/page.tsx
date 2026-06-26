import ClassifiedForm from '@/components/ClassifiedForm'

export default function EditClassifiedPage({ params }: { params: { id: string } }) {
  return <ClassifiedForm classifiedId={params.id} />
}
