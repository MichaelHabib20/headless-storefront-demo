import { legalPage } from '../_legal/LegalPage';

/** The old storefront's /privacy-policy: the legal page the admin flagged as privacy. */
const page = legalPage('privacy');
export const generateMetadata = page.generateMetadata;
export default page.LegalPage;
export const dynamic = 'force-dynamic';
