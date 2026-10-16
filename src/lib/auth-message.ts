export function authMessage(message: string): string {
  if (message.includes('Invalid login credentials')) return 'El correo o la contraseña no coinciden.'
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Ese correo ya tiene cuenta. Entrá con tu contraseña.'
  }
  if (message.includes('Email not confirmed')) return 'Confirmá el correo antes de entrar.'
  return message
}
