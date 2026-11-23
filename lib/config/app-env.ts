// Entorno de la app. NEXT_PUBLIC_APP_ENV vale "test" solo en el despliegue que
// apunta al proyecto de Pruebas de Supabase (por ejemplo, la vista previa de
// Vercel); en producción no existe o tiene otro valor.
//
// Es uno de los tres seguros del reloj de pruebas: sin este valor, la pantalla
// no se muestra y las Server Actions del reloj se niegan a correr.
export const isTestEnv = process.env.NEXT_PUBLIC_APP_ENV === "test";
