from django.conf import settings
from django.db import models


#User profle which forces first login passowrd change

class UserProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    must_change_password = models.BooleanField(default=True)
