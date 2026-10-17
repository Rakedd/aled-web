import { act, renderHook } from '@testing-library/react'
import type { StackItem, StackItemOrigin } from '@/domain/types'
import { useController } from './controller'

const reactStackItem: StackItem = { name: 'React', category: 'framework', origin: 'posting' }
const typescriptStackItem: StackItem = { name: 'TypeScript', category: 'language', origin: 'posting' }

const renderStackChipsEditorController = (stack: StackItem[] = [], origin: StackItemOrigin = 'posting') => {
  const onChange = jest.fn()
  const { result } = renderHook(() => useController({ stack, origin, onChange }))
  return { result, onChange }
}

describe('stack-chips-editor useController', () => {
  it('adds the drafted item with the chosen category and clears the draft', () => {
    const { result, onChange } = renderStackChipsEditorController([reactStackItem])
    act(() => result.current.setDraftName('  Docker '))
    act(() => result.current.setDraftCategory('tool'))
    act(() => result.current.addDraftItem())
    expect(onChange).toHaveBeenCalledWith([reactStackItem, { name: 'Docker', category: 'tool', origin: 'posting' }])
    expect(result.current.draftName).toBe('')
  })

  it('gives new items the origin received as a prop', () => {
    const { result, onChange } = renderStackChipsEditorController([], 'job_spec')
    act(() => result.current.setDraftName('Docker'))
    act(() => result.current.addDraftItem())
    expect(onChange).toHaveBeenCalledWith([{ name: 'Docker', category: 'tool', origin: 'job_spec' }])
  })

  it('does not create a duplicate when the name is already present, whatever the case', () => {
    const { result, onChange } = renderStackChipsEditorController([reactStackItem])
    act(() => result.current.setDraftName('react'))
    act(() => result.current.addDraftItem())
    expect(onChange).not.toHaveBeenCalled()
    expect(result.current.draftName).toBe('')
  })

  it('ignores a blank draft', () => {
    const { result, onChange } = renderStackChipsEditorController()
    act(() => result.current.setDraftName('   '))
    act(() => result.current.addDraftItem())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes an item', () => {
    const { result, onChange } = renderStackChipsEditorController([reactStackItem, typescriptStackItem])
    act(() => result.current.removeItem(0))
    expect(onChange).toHaveBeenCalledWith([typescriptStackItem])
  })

  it('changes the category of one item only', () => {
    const { result, onChange } = renderStackChipsEditorController([reactStackItem, typescriptStackItem])
    act(() => result.current.changeItemCategory(1, 'tool'))
    expect(onChange).toHaveBeenCalledWith([reactStackItem, { ...typescriptStackItem, category: 'tool' }])
  })
})
