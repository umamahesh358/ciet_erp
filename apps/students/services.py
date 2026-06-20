import uuid
from apps.students.models import Certification
from apps.audit.services import log_action


def verify_certification(certification_id: uuid.UUID | str, verifier, status: bool) -> Certification:
    """
    Verify or reject a student certification.
    Section 10.4: Certification Verification Logic.
    """
    cert = Certification.objects.get(id=certification_id)
    cert.is_verified = status
    cert.save(update_fields=['is_verified', 'updated_at'])
    
    action = 'CERTIFICATION_VERIFIED' if status else 'CERTIFICATION_REJECTED'
    log_action(actor=verifier, target=cert, action=action)
    
    return cert
