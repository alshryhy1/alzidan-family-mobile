/** Compatibility shim — prefer importing from `./phone`. */
export {
  canonicalizePhone,
  cleanMemberPhone,
  memberProfilePhoneQuery,
  phoneLookupCandidates as memberPhoneCandidates,
} from './phone';
