import { legalPage } from '../_legal/LegalPage';

/** The old storefront's /terms-and-conditions: the legal page the admin flagged as terms. */
const page = legalPage('terms');
export const generateMetadata = page.generateMetadata;
export default page.LegalPage;
export const dynamic = 'force-dynamic';
