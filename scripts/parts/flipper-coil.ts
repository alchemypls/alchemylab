import { shape } from './kit';
import { coil } from './coil';

export default shape('flipper-coil', 'Flipper coil', { in: [2, 0.45], mm: [51, 11], note: 'Side view. Coil types vary (FL-11630 etc.); 2" × 0.45" dia body.' }, coil(2, 0.45));
