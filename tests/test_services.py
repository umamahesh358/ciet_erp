import pytest
from django.utils import timezone
from apps.accounts.models import User, OTPRecord
from apps.accounts.services import generate_and_send_otp, verify_otp
from apps.students.models import StudentProfile, Certification
from apps.students.services import verify_certification
from apps.academics.models import Department
from datetime import timedelta

@pytest.mark.django_db
class TestServices:
    
    def test_otp_flow(self):
        user = User.objects.create(email="test@test.com", role="Student")
        generate_and_send_otp(user, "login")
        
        record = OTPRecord.objects.get(user=user)
        assert not record.is_used
        
        # Test valid verification
        result = verify_otp(user, record.otp_code, "login")
        assert result is True
        record.refresh_from_db()
        assert record.is_used

    def test_certification_verification(self):
        dept = Department.objects.create(name="CS", code="CS")
        user = User.objects.create(email="student@test.com", role="Student")
        profile = StudentProfile.objects.create(user=user, roll_no="R001", department=dept)
        cert = Certification.objects.create(
            student=profile, 
            title="Python Cert", 
            issuer="Google", 
            issued_date=timezone.now().date()
        )
        
        verifier = User.objects.create(email="faculty@test.com", role="Faculty")
        verify_certification(cert.id, verifier, True)
        
        cert.refresh_from_db()
        assert cert.is_verified is True
