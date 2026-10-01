import { start } from 'workflow/api';
type R = Awaited<ReturnType<typeof start>>;
type Keys = keyof R;
