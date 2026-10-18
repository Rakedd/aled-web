import { act, renderHook } from '@testing-library/react'
import type { BriefLanguage } from '@/domain/interview-preparation'
import { useController } from './controller'

const renderModalController = (language: BriefLanguage) => {
  const onRegenerate = jest.fn()
  const renderedHook = renderHook(() => useController({ language, onRegenerate }))
  return { ...renderedHook, onRegenerate }
}

describe('interview-preparation-modal useController', () => {
  it('regenerates in the language chosen in the modal, which starts on the current one', () => {
    const { result, onRegenerate } = renderModalController('en')
    expect(result.current.regenerationLanguage).toBe('en')
    act(() => result.current.changeRegenerationLanguage('fr'))
    act(() => result.current.requestRegeneration())
    expect(onRegenerate).toHaveBeenCalledWith('fr')
  })
})
