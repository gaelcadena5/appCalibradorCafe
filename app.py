dosis = float(input("Ingrese la dosis: "))
ratio = float(input("Ingrese el ratio: "))
liquido = float(dosis) * float(ratio)
print("El liquido es: ", liquido)
cant_vertidos = float(input("Ingrese la cantidad de vertidos: "))

liquido_por_vertido = liquido / cant_vertidos

for i in range(int(cant_vertidos)):
    print("Vertido ", i+1, ": ", liquido_por_vertido)
    
