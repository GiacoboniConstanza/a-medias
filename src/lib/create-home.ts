export type LinkedProfile = { householdId: string | null } | null

export async function finishHouseholdSetup(input: {
  call: () => PromiseLike<{ error: { message: string } | null }>
  refreshProfile: () => Promise<LinkedProfile>
  failure: string
}): Promise<string> {
  const { error } = await input.call()
  if (error) throw new Error(error.message)

  const profile = await input.refreshProfile()
  if (!profile?.householdId) throw new Error(input.failure)
  return profile.householdId
}
