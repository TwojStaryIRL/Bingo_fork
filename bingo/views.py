# Create your views here.


from django.http import HttpResponse
from django.shortcuts import render


def home(request):

    if request.method == "POST":
        return HttpResponseRedirect("/?clicked=1") #żeby nie było popupu na pierwszym załadowaniu strony

    clicked = (request.method == "POST") # tu trzeba było dodać żeby zwracało metodą POST (są 2 główne GET i POST poczytaj sobie - to do wywalenia potem)

    return render(request, "home.html", {"clicked": clicked}) # tutaj też trzeba dodać żeby zwracało ten clicked i wtedy działa popup
