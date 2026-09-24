import { useId, useState } from 'react'

import { SettingsRow, SettingsSection, reportError, useSetting } from '@/chassis'
import { Button, Input, toast } from '@/ui'

import { REPOSITORY_PATTERN, workbenchSettings } from '../state/settings'

/**
 * DEMO: the program's section of the Settings page (AppDefinition.settings).
 * Saves a setting that the release card reads.
 */
export function WorkbenchSettings() {
  const [repository, setRepository] = useSetting(workbenchSettings, 'repository')
  const [draft, setDraft] = useState(repository)
  const id = useId()

  const next = draft.trim()
  const valid = REPOSITORY_PATTERN.test(next)

  const save = async () => {
    try {
      await setRepository(next)
      toast.success('Saved', { description: `The release card now checks ${next}.` })
    } catch (error) {
      reportError(error, 'Could not save the setting')
    }
  }

  return (
    <SettingsSection title="Workbench" description="A program's own settings appear in a section like this one.">
      <SettingsRow
        label="Repository to check"
        htmlFor={id}
        description="A public GitHub repository, written as owner/name."
      >
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Input
            id={id}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={!valid}
            spellCheck={false}
            className="w-56"
          />
          <Button type="submit" size="sm" disabled={!valid || next === repository}>
            Save
          </Button>
        </form>
      </SettingsRow>
    </SettingsSection>
  )
}
