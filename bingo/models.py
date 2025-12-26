# Create your models here.



from django.conf import settings
from django.db import models

class BingoBoard(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bingo_board")
    email = models.EmailField(blank=True, default="")
    grid = models.JSONField(default=dict)  # przechowuje cały payload JSON
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"BingoBoard({self.user.username})"



class TwoFieldTab(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="two_field_tab",
    )
    value = models.CharField(max_length=200, blank=True, default="")

    def __str__(self):
        return f"TwoFieldTab({self.user_id})"





class RaffleState(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="raffle_state"
    )

    # ile zostało rerolli/shuffli
    rerolls_left = models.PositiveSmallIntegerField(default=3)
    shuffles_left = models.PositiveSmallIntegerField(default=3)

    # co user zapisał w game (snapshot konfiguracji)
    saved_board_payload = models.JSONField(default=dict, blank=True,)

    # stan wygenerowany przez raffle (np. 3 gridy + used_sets + ewentualnie pick)
    generated_board_payload = models.JSONField(default=dict, blank=True)

    # PDF finalnego boarda
    generated_board_pdf = models.FileField(
        upload_to="bingo/generated/",
        blank=True,
        null=True
    )

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"RaffleState({self.user.username})"