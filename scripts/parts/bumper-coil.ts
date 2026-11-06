import { shape } from './kit';
import { coil } from './coil';

export default shape('bumper-coil', 'Pop bumper coil', { in: [1.75, 0.45], mm: [44, 11], note: 'Side view; 1-3/4" coil sleeve.' }, coil(1.75, 0.45));
